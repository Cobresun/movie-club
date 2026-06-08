<template>
  <!-- Desktop hero: full-bleed backdrop banner, poster + title overlap from below -->
  <div v-if="isDesktop" class="-mx-4 -mt-8 mb-6">
    <div class="relative h-44 overflow-hidden bg-lowBackground">
      <img
        v-if="hasBackdrop"
        :src="`https://image.tmdb.org/t/p/w780/${backdropPath}`"
        alt=""
        decoding="async"
        loading="eager"
        class="h-full w-full object-cover transition-opacity duration-500"
        :class="backdropLoaded ? 'opacity-100' : 'opacity-0'"
        @load="backdropLoaded = true"
      />
      <div
        class="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-background"
      ></div>
    </div>

    <div class="relative -mt-20 flex flex-col items-center px-4">
      <div class="w-2/5 max-w-[180px] shadow-2xl">
        <PosterImage :image-url="posterUrl" />
      </div>
      <h2 class="mt-3 text-center text-xl font-bold">
        {{ title
        }}<span v-if="year" class="font-normal text-gray-300">
          ({{ year }})</span
        >
      </h2>
      <div class="mt-1 text-center text-sm text-gray-400">
        <slot name="date">{{ dateLabel }}</slot>
      </div>
    </div>
  </div>

  <!-- Mobile hero: shorter backdrop, compact poster + title row sits on it -->
  <div v-else class="-mx-4 -mt-8 mb-4">
    <div class="relative h-44 overflow-hidden bg-lowBackground">
      <img
        v-if="hasBackdrop"
        :src="`https://image.tmdb.org/t/p/w780/${backdropPath}`"
        alt=""
        decoding="async"
        loading="eager"
        class="h-full w-full object-cover transition-opacity duration-500"
        :class="backdropLoaded ? 'opacity-50' : 'opacity-0'"
        @load="backdropLoaded = true"
      />
      <div
        class="absolute inset-0 bg-gradient-to-b from-black/20 via-background/40 to-background"
      ></div>
    </div>

    <div class="relative -mt-20 flex items-end gap-3 px-4">
      <div class="w-20 flex-shrink-0 shadow-lg">
        <PosterImage :image-url="posterUrl" />
      </div>
      <div class="flex min-w-0 flex-col pb-1">
        <h2 class="text-xl font-bold leading-tight">
          {{ title
          }}<span v-if="year" class="font-normal text-gray-300">
            ({{ year }})</span
          >
        </h2>
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
