<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";

defineProps<{
  /** The game's name ("Reelated"), so the placeholder announces what is loading. */
  name: string;
}>();
</script>

<template>
  <!-- Mirrors DailyGameBoard before a first guess — the title, the blurb, the
       hints menu and archive links, then the guess field — so nothing shifts
       when the puzzle lands. -->
  <div
    class="mx-auto flex max-w-2xl flex-col gap-6 px-4 pt-2 pb-16"
    role="status"
    :aria-label="`Loading ${name}`"
  >
    <div class="flex flex-col items-center gap-3">
      <SkeletonBlock class="h-9 w-56 max-w-full rounded-lg sm:h-10" />
      <div class="flex w-full flex-col items-center gap-2" :style="{ '--skeleton-index': 1 }">
        <SkeletonBlock class="h-4 w-full max-w-md rounded" />
        <SkeletonBlock class="h-4 w-64 max-w-full rounded" />
      </div>
      <SkeletonBlock class="h-11 w-40 rounded-full" :style="{ '--skeleton-index': 2 }" />
      <SkeletonBlock class="h-5 w-28 rounded" :style="{ '--skeleton-index': 3 }" />
    </div>

    <div class="flex flex-col gap-1.5" :style="{ '--skeleton-index': 4 }">
      <SkeletonBlock class="h-4 w-28 rounded" />
      <SkeletonBlock class="h-[50px] w-full rounded-[10px]" />
    </div>
  </div>
</template>
