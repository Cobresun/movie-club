<script setup lang="ts">
import SkeletonBlock from "./SkeletonBlock.vue";

const { count = 4 } = defineProps<{ count?: number }>();

// Cycled so the pills come out uneven, the way real names are.
const nameWidths = ["w-16", "w-24", "w-14", "w-20"];
</script>

<template>
  <div class="flex flex-wrap justify-center gap-2">
    <div
      v-for="i in count"
      :key="i"
      class="inline-flex items-center gap-2 rounded-full border-2 border-slate-600 px-3 py-1.5"
      :style="{ '--skeleton-index': i - 1 }"
    >
      <SkeletonBlock class="h-6 w-6 rounded-full" />
      <SkeletonBlock class="h-3 rounded" :class="nameWidths[(i - 1) % nameWidths.length]" />
    </div>
  </div>
</template>
