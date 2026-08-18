<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
</script>

<template>
  <!-- Mirrors SharedReviewView: title and poster on the left, the club-average
       box and one row per member's score on the right. -->
  <div class="mx-auto max-w-6xl" role="status" aria-label="Loading review">
    <div class="rounded-lg bg-slate-700/30 p-8">
      <div class="flex flex-col gap-8 sm:flex-row">
        <div class="flex flex-shrink-0 flex-col gap-4 sm:w-1/3">
          <SkeletonBlock class="h-10 w-3/4 rounded-lg" />
          <SkeletonBlock class="h-4 w-1/2 rounded" />
          <SkeletonBlock class="aspect-[2/3] w-full rounded-lg" />
        </div>

        <div class="flex-1 space-y-4 self-center">
          <SkeletonBlock class="mt-6 h-28 w-full rounded-lg" />
          <div
            v-for="member in 4"
            :key="member"
            class="flex items-center justify-between gap-4 rounded-lg bg-slate-800/70 p-4"
            :style="{ '--skeleton-index': member - 1 }"
          >
            <div class="flex min-w-0 items-center gap-4">
              <SkeletonBlock class="h-12 w-12 shrink-0 rounded-full" />
              <div class="flex flex-col gap-2">
                <SkeletonBlock class="h-4 w-28 rounded" />
                <SkeletonBlock class="h-3 w-20 rounded" />
              </div>
            </div>
            <SkeletonBlock class="h-7 w-14 shrink-0 rounded" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
