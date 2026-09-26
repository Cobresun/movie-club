<template>
  <div class="flex flex-col gap-3">
    <div v-if="hasElements(presets)" class="flex flex-wrap gap-2">
      <button
        v-for="preset in presets"
        :key="preset.label"
        type="button"
        :aria-pressed="isPresetActive(preset)"
        :disabled="!isPresetActive(preset) && !presetHasMatches(preset)"
        class="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors duration-fast disabled:cursor-not-allowed disabled:opacity-35"
        :class="
          isPresetActive(preset)
            ? 'border-primary bg-primary text-white'
            : 'border-slate-600 text-slate-200 enabled:hover:border-slate-400 enabled:hover:text-white'
        "
        @click="togglePreset(preset)"
      >
        {{ preset.label }}
        <span v-if="isDefined(preset.detail)" class="text-xs opacity-70">{{ preset.detail }}</span>
      </button>
    </div>

    <div aria-hidden="true" class="flex h-14 items-end gap-[3px]">
      <div
        v-for="bar in bars"
        :key="bar.start"
        class="flex-1 rounded-t-sm transition-colors duration-fast"
        :class="
          bar.selected ? 'bg-primary' : isDefined(selection) ? 'bg-slate-600/40' : 'bg-slate-500/70'
        "
        :style="{ height: `${bar.height}px` }"
      ></div>
    </div>

    <div class="range-slider relative h-7">
      <div class="absolute inset-x-0 top-3 h-1 rounded-full bg-slate-600"></div>
      <div
        v-if="isDefined(selection)"
        class="absolute top-3 h-1 rounded-full bg-primary"
        :style="selectedTrackStyle"
      ></div>
      <input
        type="range"
        :min="scale.lo"
        :max="scale.hi"
        :step="option.step"
        :value="fromValue"
        :aria-label="`Minimum ${option.label.toLowerCase()}`"
        :aria-valuetext="option.format(fromValue)"
        @input="onFromInput"
      />
      <input
        type="range"
        :min="scale.lo"
        :max="scale.hi"
        :step="option.step"
        :value="toValue"
        :aria-label="`Maximum ${option.label.toLowerCase()}`"
        :aria-valuetext="option.format(toValue)"
        @input="onToInput"
      />
    </div>

    <div aria-hidden="true" class="flex justify-between text-xs text-slate-500">
      <span>{{ option.format(scale.lo) }}</span>
      <span>{{ option.format(scale.hi) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasElements, isDefined } from "../../../lib/checks/checks";
import type { DetailedWorkListItem } from "../../../lib/types/lists";
import type { RangeFilterOption } from "../clubType";
import { rangeIncludes } from "../filterMatchers";
import type { RangePreset, RangeSelection } from "./filterTypes";

const props = defineProps<{
  option: RangeFilterOption;
  /** Every work in the club: fixes the slider's ends and the presets. */
  allWorks: DetailedWorkListItem[];
  /** Works left by the other filters: what the histogram draws. */
  works: DetailedWorkListItem[];
  selection: RangeSelection | undefined;
}>();

const emit = defineEmits<{
  (e: "update:selection", selection: RangeSelection | undefined): void;
}>();

const MAX_BARS = 30;
const BAR_MIN_HEIGHT = 3;
const BAR_MAX_HEIGHT = 56;

const allValues = computed(() => props.allWorks.map(props.option.value).filter(isDefined));

const presets = computed(() => props.option.presets(allValues.value));

/**
 * The slider's ends snap outwards to whole histogram bars so the two line up.
 * A long span (books published across centuries) widens the bars rather than
 * drawing hundreds of slivers.
 */
const scale = computed(() => {
  const min = Math.min(...allValues.value);
  const max = Math.max(...allValues.value);
  let bucket = props.option.bucket;
  const bounds = (size: number) => {
    const lo = Math.floor(min / size) * size;
    return { lo, hi: Math.max(Math.ceil(max / size) * size, lo + size) };
  };
  while ((bounds(bucket).hi - bounds(bucket).lo) / bucket > MAX_BARS) bucket *= 2;
  return { ...bounds(bucket), bucket };
});

const clamp = (value: number) => Math.min(scale.value.hi, Math.max(scale.value.lo, value));

const fromValue = computed(() => clamp(props.selection?.from ?? scale.value.lo));
const toValue = computed(() => clamp(props.selection?.to ?? scale.value.hi));

const bars = computed(() => {
  const { lo, hi, bucket } = scale.value;
  const count = Math.round((hi - lo) / bucket);
  const tallies = Array.from({ length: count }, () => 0);
  for (const work of props.works) {
    const value = props.option.value(work);
    if (value === undefined) continue;
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - lo) / bucket)));
    tallies[index] += 1;
  }
  const busiest = Math.max(1, ...tallies);
  return tallies.map((tally, index) => {
    const start = lo + index * bucket;
    return {
      start,
      height:
        tally === 0
          ? BAR_MIN_HEIGHT
          : BAR_MIN_HEIGHT + (tally / busiest) * (BAR_MAX_HEIGHT - BAR_MIN_HEIGHT),
      selected:
        isDefined(props.selection) && start + bucket > fromValue.value && start <= toValue.value,
    };
  });
});

// The thumbs are 20px wide, so their centres travel between 10px and
// (width - 10px); the fill has to inset by the same amount to line up.
const selectedTrackStyle = computed(() => {
  const { lo, hi } = scale.value;
  const span = Math.max(1, hi - lo);
  const fromFraction = (fromValue.value - lo) / span;
  const toFraction = (toValue.value - lo) / span;
  return {
    left: `calc(10px + (100% - 20px) * ${fromFraction})`,
    width: `calc((100% - 20px) * ${toFraction - fromFraction} + 4px)`,
  };
});

/** A thumb resting on the end of the rail leaves that side open. */
function update(from: number, to: number) {
  const next: RangeSelection = {
    kind: "range",
    from: from <= scale.value.lo ? undefined : from,
    to: to >= scale.value.hi ? undefined : to,
  };
  emit("update:selection", next.from === undefined && next.to === undefined ? undefined : next);
}

// The two thumbs share one rail, so neither may cross the other. Writing the
// clamped value back matters when it equals the current one: Vue sees no
// change to patch, and the thumb would otherwise stay where it was dragged.
function onFromInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  const from = Math.min(Number(event.target.value), toValue.value);
  event.target.value = String(from);
  update(from, toValue.value);
}

function onToInput(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return;
  const to = Math.max(Number(event.target.value), fromValue.value);
  event.target.value = String(to);
  update(fromValue.value, to);
}

function isPresetActive(preset: RangePreset) {
  return (
    isDefined(props.selection) &&
    props.selection.from === preset.from &&
    props.selection.to === preset.to
  );
}

function presetHasMatches(preset: RangePreset) {
  const span: RangeSelection = { kind: "range", from: preset.from, to: preset.to };
  return props.works.some((work) => rangeIncludes(props.option.value(work), span));
}

function togglePreset(preset: RangePreset) {
  emit(
    "update:selection",
    isPresetActive(preset) ? undefined : { kind: "range", from: preset.from, to: preset.to },
  );
}
</script>

<style scoped>
/* Stacked range inputs: the tracks are transparent so the shared rail shows
   through, and only the thumbs take pointer events so both stay grabbable. */
.range-slider input[type="range"] {
  @apply absolute inset-x-0 top-0 m-0 h-7 w-full appearance-none bg-transparent;
  pointer-events: none;
}

.range-slider input[type="range"]::-webkit-slider-thumb {
  @apply h-5 w-5 appearance-none rounded-full border-[3px] border-primary bg-white;
  margin-top: 4px;
  pointer-events: auto;
}

.range-slider input[type="range"]::-moz-range-thumb {
  @apply h-5 w-5 rounded-full border-[3px] border-primary bg-white;
  pointer-events: auto;
}
</style>
