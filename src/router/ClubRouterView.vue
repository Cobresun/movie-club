<template>
  <div>
    <ClubSectionNav :key="clubSlug" :club-slug="clubSlug" />
    <!-- Room for the fixed mobile section bar so it never covers the last row. -->
    <div class="pb-[62px] md:pb-0">
      <router-view :key="clubSlug" />
    </div>
  </div>
</template>

<script setup lang="ts">
import ClubSectionNav from "@/common/components/ClubSectionNav.vue";

defineProps<{ clubSlug: string }>();
</script>
