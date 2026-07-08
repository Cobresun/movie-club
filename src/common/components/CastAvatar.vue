<template>
  <div
    v-if="showImage"
    class="overflow-hidden rounded-full bg-lowBackground"
    :class="{ 'animate-pulse': !loaded }"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <img
      :src="src"
      :alt="name"
      decoding="async"
      class="h-full w-full rounded-full object-cover transition-opacity duration-slow ease-standard"
      :class="loaded ? 'opacity-100' : 'opacity-0'"
      @load="loaded = true"
      @error="errored = true"
    />
  </div>
  <v-avatar v-else :name="name" :size="size" />
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { isDefined } from "../../../lib/checks/checks";
import { profileImageUrl } from "../tmdbImages";

interface Props {
  name: string;
  profilePath: string | null;
  size?: number;
}
const { name, profilePath, size = 64 } = defineProps<Props>();

const loaded = ref(false);
const errored = ref(false);

const src = computed(() => profileImageUrl(profilePath));
// Show the photo unless it's missing or failed to load — otherwise fall back to
// VAvatar's seeded-colour initials (shown immediately, with no loading skeleton).
const showImage = computed(() => isDefined(src.value) && !errored.value);
</script>
