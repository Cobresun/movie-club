<template>
  <div
    role="group"
    :aria-label="label"
    class="flex flex-col rounded-xl bg-lowBackground p-3.5 sm:p-4"
  >
    <p class="text-xs font-medium uppercase tracking-wide text-slate-400">{{ label }}</p>
    <p class="mt-1 text-2xl font-bold tabular-nums text-white sm:text-3xl">
      {{ formatCount(count.current) }}
    </p>
    <p v-if="change" class="mt-1 text-xs">
      <span
        class="font-semibold"
        :class="{
          'text-emerald-400': change.direction === 'up',
          'text-rose-400': change.direction === 'down',
          'text-slate-400': change.direction === 'flat',
        }"
      >
        {{ change.label }}
      </span>
      <span class="ml-1 text-slate-500">{{ comparison }}</span>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { PeriodCount } from "../../../../lib/types/metrics";
import { formatChange, formatCount } from "../formatMetrics";

const props = defineProps<{
  label: string;
  count: PeriodCount;
  /** "vs prior 30 days". */
  comparison: string;
}>();

const change = computed(() => formatChange(props.count));
</script>
