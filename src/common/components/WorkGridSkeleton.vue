<script setup lang="ts">
import SkeletonBlock from "./SkeletonBlock.vue";

/**
 * Placeholder for the poster grids (reviews gallery, watchlists, shared lists,
 * search results). `lines` and `avatars` shape the block under the poster so
 * the skeleton lands on roughly the same geometry as the cards that replace it.
 */
const {
  count = 12,
  lines = 1,
  avatars = false,
  size = "md",
} = defineProps<{
  count?: number;
  lines?: number;
  avatars?: boolean;
  size?: "sm" | "md";
}>();
</script>

<template>
  <div
    class="grid justify-items-center gap-4"
    :style="{
      gridTemplateColumns: `repeat(auto-fill, minmax(${size === 'sm' ? 136 : 160}px, 1fr))`,
    }"
  >
    <div
      v-for="i in count"
      :key="i"
      :class="size === 'sm' ? 'w-32' : 'w-40'"
      :style="{ '--skeleton-index': Math.min(i - 1, 8) }"
    >
      <div class="flex flex-col overflow-hidden rounded-lg bg-slate-700/40">
        <SkeletonBlock class="aspect-[2/3] w-full" />
        <div class="flex flex-col items-center gap-2 px-2 py-3">
          <SkeletonBlock class="h-4 w-3/4 rounded" />
          <SkeletonBlock v-for="line in lines" :key="line" class="h-3 w-1/2 rounded" />
          <div v-if="avatars" class="mt-1 flex gap-2">
            <SkeletonBlock v-for="avatar in 3" :key="avatar" class="h-6 w-6 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
