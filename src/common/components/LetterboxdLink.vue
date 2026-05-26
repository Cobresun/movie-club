<template>
  <a
    v-if="letterboxdUrl"
    :href="letterboxdUrl"
    target="_blank"
    rel="noopener noreferrer"
    class="flex items-center gap-2 text-primary hover:underline"
  >
    <span>Letterboxd</span>
    <mdicon name="open-in-new" size="14" />
  </a>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../lib/checks/checks.js";

const props = defineProps<{
  tmdbId?: string;
}>();

const letterboxdUrl = computed(() =>
  hasValue(props.tmdbId)
    ? `https://letterboxd.com/tmdb/${props.tmdbId}/`
    : undefined,
);
</script>
