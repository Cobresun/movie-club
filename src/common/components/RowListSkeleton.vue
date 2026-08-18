<script setup lang="ts">
import SkeletonBlock from "./SkeletonBlock.vue";

/**
 * Stacked-row placeholder — award categories, member rows, anything rendered as
 * a vertical list of cards. `rowClass` carries the caller's own row chrome so
 * the skeleton inherits the surface it is standing in for.
 */
const {
  count = 4,
  lines = 1,
  avatar = false,
  rowClass = "rounded-xl bg-lowBackground p-4",
} = defineProps<{
  count?: number;
  lines?: number;
  avatar?: boolean;
  rowClass?: string;
}>();

const lineWidths = ["w-40", "w-56", "w-32", "w-48"];
</script>

<template>
  <div class="flex flex-col gap-2">
    <div
      v-for="i in count"
      :key="i"
      class="flex items-center gap-3"
      :class="rowClass"
      :style="{ '--skeleton-index': i - 1 }"
    >
      <SkeletonBlock v-if="avatar" class="h-10 w-10 shrink-0 rounded-full" />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <SkeletonBlock
          v-for="line in lines"
          :key="line"
          class="h-4 max-w-full rounded"
          :class="lineWidths[(i + line) % lineWidths.length]"
        />
      </div>
    </div>
  </div>
</template>
