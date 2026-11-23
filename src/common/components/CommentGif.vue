<template>
  <!-- A fixed height, so a GIF that loads after the thread has scrolled to
       the newest comment does not push it out of view. -->
  <img
    :src="giphyImageUrl(gifId, '200')"
    alt="GIF"
    loading="lazy"
    class="h-40 w-auto max-w-full rounded-md bg-gray-700 object-contain"
  />
</template>

<script setup lang="ts">
import { giphyImageUrl } from "../../../lib/giphy";

defineProps<{ gifId: string }>();
</script>
