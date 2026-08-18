<script setup lang="ts">
import SkeletonBlock from "./SkeletonBlock.vue";
import WorkGridSkeleton from "./WorkGridSkeleton.vue";
</script>

<template>
  <!-- Mirrors WorkSearchPrompt: filter box, section heading, results grid. -->
  <div class="flex flex-col" role="status" aria-label="Loading">
    <SkeletonBlock class="h-9 w-full rounded-md" />
    <SkeletonBlock class="mt-4 h-4 w-32 rounded" />
    <WorkGridSkeleton class="mt-3" size="sm" :count="8" :lines="0" />
  </div>
</template>
