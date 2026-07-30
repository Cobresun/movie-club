<template>
  <div class="rounded-xl bg-lowBackground p-4">
    <p class="text-sm text-slate-400">{{ label }}</p>

    <p v-if="percent === null" class="mt-1 text-2xl font-bold text-slate-600">—</p>
    <p v-else class="mt-1 text-2xl font-bold" :class="toneClass">{{ percent }}%</p>

    <p class="mt-1 text-xs text-slate-500">{{ detail }}</p>
    <p class="mt-1 text-xs text-slate-600">{{ hint }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

/**
 * A percentage that keeps its raw fraction visible.
 *
 * On a site this size a rate is routinely computed over a handful of rows, and
 * "67%" reads as a finding while "2 of 3" reads as noise — which is the honest
 * reading. Both are always shown for that reason.
 */
const props = defineProps<{
  label: string;
  /** Null renders an em dash: the metric has no denominator, so there is no rate. */
  percent: number | null;
  /** The raw fraction behind the percentage, e.g. "5 of 8". */
  detail: string;
  /** One line on what the number means. */
  hint: string;
  /**
   * Percentage at or above which the rate reads as healthy. Omit for metrics
   * with no good direction — a signup-source split isn't better when higher.
   */
  goodAtOrAbove?: number;
  /** Below this the rate reads as a problem. */
  badBelow?: number;
}>();

const toneClass = computed(() => {
  if (props.percent === null) return "text-slate-600";
  if (props.badBelow !== undefined && props.percent < props.badBelow) return "text-rose-400";
  if (props.goodAtOrAbove !== undefined && props.percent >= props.goodAtOrAbove) {
    return "text-emerald-400";
  }
  return "text-white";
});
</script>
