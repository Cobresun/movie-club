<template>
  <!-- One layout for both drawers: the desktop side drawer is roughly
       phone-width (~35vw), so the poster-left row works at every size — only
       the poster/backdrop scale up slightly on desktop. The negative margins
       bleed the backdrop to the drawer edges (both containers pad px-4 pt-8). -->
  <div class="-mx-4 -mt-8 mb-5">
    <div
      class="relative overflow-hidden bg-lowBackground"
      :class="isDesktop ? 'h-52' : 'h-44'"
    >
      <img
        v-if="hasBackdrop"
        :src="`https://image.tmdb.org/t/p/w780/${backdropPath}`"
        alt=""
        decoding="async"
        loading="eager"
        class="h-full w-full object-cover transition-opacity duration-500"
        :class="backdropLoaded ? 'opacity-60' : 'opacity-0'"
        @load="backdropLoaded = true"
      />
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/30 via-background/40 to-background"
      ></div>
    </div>

    <div class="relative -mt-20 flex items-end gap-4 px-4">
      <div
        class="flex-shrink-0 overflow-hidden rounded-lg shadow-xl ring-1 ring-white/10"
        :class="isDesktop ? 'w-28' : 'w-24'"
      >
        <PosterImage :image-url="posterUrl" />
      </div>
      <div class="flex min-w-0 flex-col pb-0.5">
        <h2
          class="font-bold leading-tight"
          :class="isDesktop ? 'text-2xl' : 'text-xl'"
        >
          {{ title
          }}<span v-if="year" class="font-normal text-gray-400">
            ({{ year }})</span
          >
        </h2>
        <!-- Media facts: runtime · genres for movies, authors · pages for books -->
        <div v-if="$slots.meta" class="mt-1 text-sm leading-snug text-gray-300">
          <slot name="meta" />
        </div>
        <div class="mt-1 text-sm text-gray-400">
          <slot name="date">{{ dateLabel }}</slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

import { hasValue } from "../../../lib/checks/checks.js";

import PosterImage from "@/common/components/PosterImage.vue";

const props = withDefaults(
  defineProps<{
    posterUrl?: string | null;
    backdropPath?: string | null;
    title: string;
    year?: string | number;
    dateLabel?: string;
    isDesktop: boolean;
  }>(),
  {
    posterUrl: null,
    backdropPath: null,
    year: undefined,
    dateLabel: "",
  },
);

const backdropLoaded = ref(false);
const hasBackdrop = computed(() => hasValue(props.backdropPath));
</script>
