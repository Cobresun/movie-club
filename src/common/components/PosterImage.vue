<template>
  <div
    class="aspect-[2/3] overflow-hidden rounded-lg bg-lowBackground"
    :class="{ 'animate-pulse': !loaded && hasImage }"
  >
    <img
      v-if="hasImage"
      :src="imageUrl ?? ''"
      :alt="alt"
      decoding="async"
      loading="eager"
      class="h-full w-full object-cover transition-opacity duration-slow ease-standard"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../lib/checks/checks.js";

// `imageUrl` is the work's stored cover/poster URL (already fully-qualified for
// both Google Books covers and movie posters resolved via `workPosterUrl`).
const { imageUrl = null, alt = "Poster" } = defineProps<{
  imageUrl?: string | null;
  alt?: string;
}>();

const loaded = ref(false);
const hasImage = computed(() => hasValue(imageUrl));
</script>
