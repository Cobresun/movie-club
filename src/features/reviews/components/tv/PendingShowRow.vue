<template>
  <article
    class="animate-fade-up border-primary/30 bg-primary/[0.04] rounded-lg border text-left"
    aria-busy="true"
  >
    <div class="flex items-center gap-3 p-2.5 md:gap-5 md:p-3">
      <div class="relative h-[66px] w-11 shrink-0 overflow-hidden rounded-md md:h-[84px] md:w-14">
        <img
          v-if="hasValue(review.imageUrl)"
          :src="review.imageUrl"
          alt=""
          class="h-full w-full object-cover opacity-60"
        />
        <SkeletonBlock v-else class="h-full w-full" />
      </div>

      <div class="flex min-w-0 grow flex-col gap-1.5">
        <h2 class="line-clamp-2 text-base leading-snug font-semibold md:text-lg">
          {{ review.title }}
        </h2>
        <span role="status" class="flex items-center gap-2 text-xs text-gray-400 md:text-sm">
          <span
            class="border-primary h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-t-transparent"
            aria-hidden="true"
          />
          {{ status }}
        </span>
        <div class="flex items-center gap-2" aria-hidden="true">
          <SkeletonBlock class="h-1 w-16 rounded-full md:w-28" />
          <SkeletonBlock class="h-3 w-20 rounded-full" />
        </div>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1.5 pr-1" aria-hidden="true">
        <SkeletonBlock class="h-7 w-10 rounded-md" />
        <SkeletonBlock class="h-2.5 w-12 rounded-full" />
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from "vue";

import { hasValue } from "../../../../../lib/checks/checks.js";
import { DetailedReviewListItem } from "../../../../../lib/types/lists";
import SkeletonBlock from "@/common/components/SkeletonBlock.vue";
import { OPTIMISTIC_WORK_ID } from "@/service/useList";

const props = defineProps<{ review: DetailedReviewListItem }>();

// Two waits look the same from here but differ in what is left: the add
// itself, or TMDB's season and episode listing the server fetches after it.
const status = computed(() =>
  props.review.id === OPTIMISTIC_WORK_ID ? "Adding to the club…" : "Getting seasons and episodes…",
);
</script>
