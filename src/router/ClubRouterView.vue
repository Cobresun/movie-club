<template>
  <div>
    <ClubSectionNav :key="clubSlug" :club-slug="clubSlug" />
    <InstallAppBanner />
    <!-- Room for the fixed mobile section bar so it never covers the last row. -->
    <div class="pb-[62px] md:pb-0">
      <router-view :key="clubSlug" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

import { prefetchClubSections } from "./clubSectionViews";
import ClubSectionNav from "@/common/components/ClubSectionNav.vue";
import InstallAppBanner from "@/common/components/InstallAppBanner.vue";

defineProps<{ clubSlug: string }>();

// Once the section the member landed on has had the main thread to itself.
let cancelPrefetch: (() => void) | undefined;
onMounted(() => {
  if (typeof window.requestIdleCallback === "function") {
    const handle = window.requestIdleCallback(prefetchClubSections, { timeout: 10_000 });
    cancelPrefetch = () => window.cancelIdleCallback(handle);
  } else {
    // Safari/jsdom: no requestIdleCallback; a delay long enough to clear the
    // first render and its requests instead.
    const handle = setTimeout(prefetchClubSections, 3000);
    cancelPrefetch = () => clearTimeout(handle);
  }
});
onBeforeUnmount(() => cancelPrefetch?.());
</script>
