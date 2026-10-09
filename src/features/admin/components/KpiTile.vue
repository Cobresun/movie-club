<template>
  <div class="rounded-xl bg-lowBackground p-4">
    <p class="text-sm text-slate-400">{{ label }}</p>
    <div class="mt-1 flex items-baseline gap-2">
      <p ref="valueEl" class="text-2xl font-bold tabular-nums text-white">
        {{ formatCount(shownValue) }}
      </p>
      <span v-if="deltaLabel !== null" class="text-xs font-medium" :class="deltaClass">
        {{ deltaLabel }}
      </span>
    </div>
    <p v-if="hasValue(caption)" class="mt-1 text-xs text-slate-500">{{ caption }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../../lib/checks/checks.js";
import { formatCount } from "../formatMetrics";
import { useCountUp } from "@/common/composables/useCountUp";

const props = defineProps<{
  label: string;
  value: number;
  caption?: string;
  /**
   * Change over the last week, from the snapshot history. `null` means no
   * snapshot reaches back that far — rendered as nothing rather than as "+0",
   * because "no baseline" and "no change" are opposite claims.
   */
  delta?: number | null;
}>();

const valueEl = ref<HTMLElement | null>(null);
const shownValue = useCountUp(() => props.value, valueEl);

const deltaLabel = computed(() => {
  const delta = props.delta;
  if (delta === undefined || delta === null || delta === 0) {
    return null;
  }
  return `${delta > 0 ? "+" : "−"}${formatCount(Math.abs(delta))} this week`;
});

// These are running totals, so a decrease means rows were deleted — worth
// flagging in red rather than treating as a neutral movement.
const deltaClass = computed(() =>
  props.delta !== undefined && props.delta !== null && props.delta < 0
    ? "text-rose-400"
    : "text-emerald-400",
);
</script>
