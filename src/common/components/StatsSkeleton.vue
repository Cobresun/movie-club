<script setup lang="ts">
import SkeletonBlock from "./SkeletonBlock.vue";

const { count = 3 } = defineProps<{ count?: number }>();

// Charts aren't all the same height; varying the plot area keeps the
// placeholder from reading as a stack of identical boxes.
const plotHeights = ["h-48", "h-36", "h-56"];
</script>

<template>
  <div class="space-y-6 pb-6" role="status" aria-label="Loading statistics">
    <!-- One block per WidgetShell: header row (title + subtitle + controls)
         above the plot area. -->
    <div v-for="i in count" :key="i" class="mx-auto w-11/12" :style="{ '--skeleton-index': i - 1 }">
      <div class="rounded-xl bg-lowBackground p-4 sm:p-5">
        <div class="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div class="flex flex-col gap-2 text-left">
            <SkeletonBlock class="h-5 w-44 rounded" />
            <SkeletonBlock class="h-3 w-60 max-w-full rounded" />
          </div>
          <SkeletonBlock class="h-8 w-28 rounded-full" />
        </div>
        <SkeletonBlock
          class="w-full rounded-lg"
          :class="plotHeights[(i - 1) % plotHeights.length]"
        />
      </div>
    </div>
  </div>
</template>
