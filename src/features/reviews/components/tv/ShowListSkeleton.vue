<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
</script>

<template>
  <!-- Mirrors ReviewView for a TV club: the search/filter bar, then ShowListView's
       show rows — poster, title and coverage, and the club's score. -->
  <div role="status" aria-label="Loading reviews">
    <div class="mb-4 flex items-center justify-center gap-2">
      <SkeletonBlock class="h-11 w-full max-w-xl rounded-lg" />
      <SkeletonBlock class="h-11 w-11 rounded-lg" />
    </div>
    <div class="mx-auto flex w-full max-w-5xl flex-col gap-3 md:px-6">
      <div
        v-for="row in 4"
        :key="row"
        class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3 md:gap-5"
      >
        <SkeletonBlock class="h-[84px] w-14 shrink-0 rounded-md md:h-24 md:w-16" />
        <div class="flex min-w-0 flex-grow flex-col gap-2">
          <SkeletonBlock class="h-5 w-40 rounded-md" />
          <SkeletonBlock class="h-3 w-32 rounded-full" />
          <SkeletonBlock class="h-1 w-16 rounded-full md:w-28" />
          <SkeletonBlock class="h-7 w-28 rounded-full" />
        </div>
        <div class="flex shrink-0 flex-col items-end gap-1.5">
          <SkeletonBlock class="h-7 w-10 rounded-md" />
          <SkeletonBlock class="h-2.5 w-12 rounded-full" />
        </div>
      </div>
    </div>
  </div>
</template>
