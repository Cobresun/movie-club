<template>
  <!-- A row on phones, so three rates don't stack into a screen of cards. -->
  <div
    class="flex items-center gap-4 rounded-xl bg-lowBackground p-3.5 sm:flex-col sm:items-start sm:gap-1 sm:p-4"
  >
    <p v-if="percent === null" class="w-16 shrink-0 text-2xl font-bold text-slate-500 sm:w-auto">
      —
    </p>
    <p v-else class="w-16 shrink-0 text-2xl font-bold tabular-nums sm:w-auto" :class="toneClass">
      {{ percent }}%
    </p>

    <div class="min-w-0 sm:contents">
      <p class="text-xs font-medium uppercase tracking-wide text-slate-400 sm:order-first">
        {{ label }}
      </p>
      <p class="mt-0.5 text-xs text-slate-300">{{ detail }}</p>
      <p class="mt-0.5 text-xs text-slate-500">{{ hint }}</p>
    </div>
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
   * with no good direction.
   */
  goodAtOrAbove?: number;
  /** Below this the rate reads as a problem. */
  badBelow?: number;
}>();

const toneClass = computed(() => {
  if (props.percent === null) return "text-slate-500";
  if (props.badBelow !== undefined && props.percent < props.badBelow) return "text-rose-400";
  if (props.goodAtOrAbove !== undefined && props.percent >= props.goodAtOrAbove) {
    return "text-emerald-400";
  }
  return "text-white";
});
</script>
