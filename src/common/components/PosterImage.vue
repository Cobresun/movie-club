<template>
  <div
    class="aspect-[2/3] overflow-hidden rounded-lg bg-lowBackground"
    :class="{ 'animate-pulse': !loaded && hasPoster }"
  >
    <img
      v-if="hasPoster"
      :src="`https://image.tmdb.org/t/p/w500/${posterPath}`"
      :alt="alt"
      decoding="async"
      loading="eager"
      class="h-full w-full object-cover transition-opacity duration-300"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../lib/checks/checks.js";

const props = withDefaults(
  defineProps<{ posterPath?: string | null; alt?: string }>(),
  { posterPath: null, alt: "Movie poster" },
);

const loaded = ref(false);
const hasPoster = computed(() => hasValue(props.posterPath));
</script>
