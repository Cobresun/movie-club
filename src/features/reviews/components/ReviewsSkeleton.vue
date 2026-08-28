<script setup lang="ts">
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import WorkGridSkeleton from "@/common/components/WorkGridSkeleton.vue";
</script>

<template>
  <!-- Mirrors ReviewView: search/filter bar, the sort pills GalleryView renders,
       then the gallery itself (score avatars under each poster). -->
  <div role="status" aria-label="Loading reviews">
    <div class="mb-4 flex items-center justify-center gap-2">
      <SkeletonBlock class="h-11 w-full max-w-xl rounded-lg" />
      <SkeletonBlock class="h-11 w-11 rounded-lg" />
    </div>
    <div class="w-full md:px-6">
      <div class="mb-4 flex flex-wrap items-center gap-2">
        <SkeletonBlock class="h-8 w-32 rounded-full" />
        <SkeletonBlock class="h-8 w-28 rounded-full" />
      </div>
      <WorkGridSkeleton :count="12" avatars />
    </div>
  </div>
</template>
