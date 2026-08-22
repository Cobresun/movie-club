<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import WorkGridSkeleton from "@/common/components/WorkGridSkeleton.vue";
</script>

<template>
  <!-- Mirrors WatchListView: the search/filter bar, then a couple of list
       sections with their header row and poster grid. -->
  <div role="status" aria-label="Loading lists">
    <div class="mb-4 flex items-center justify-center gap-2">
      <SkeletonBlock class="h-11 w-full max-w-xl rounded-lg" />
      <SkeletonBlock class="h-11 w-32 rounded-lg" />
    </div>

    <div class="flex flex-col gap-6">
      <section
        v-for="section in 2"
        :key="section"
        class="rounded-lg border border-slate-700 bg-slate-900/40 p-2 sm:p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <div class="flex min-w-0 items-center gap-2">
            <SkeletonBlock class="h-9 w-9 rounded-md" />
            <SkeletonBlock class="h-6 w-40 max-w-full rounded" />
          </div>
          <div class="flex flex-shrink-0 items-center gap-2">
            <SkeletonBlock v-for="action in 3" :key="action" class="h-9 w-9 rounded-md" />
          </div>
        </div>
        <WorkGridSkeleton class="my-4" :count="6" />
      </section>
    </div>
  </div>
</template>
