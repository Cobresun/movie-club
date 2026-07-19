<template>
  <li class="relative pb-4 pl-5 last:pb-0">
    <span
      class="absolute -left-[5.5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary"
      aria-hidden="true"
    />

    <div class="flex items-start justify-between gap-3">
      <div class="flex min-w-0 flex-1 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-sm text-gray-300">{{ displayDate }}</span>
          <mdicon
            v-if="watch.rewatch"
            name="repeat"
            :size="16"
            class="shrink-0 text-gray-400"
            :title="repeatBadge"
            :aria-label="repeatBadge"
          />
        </div>
        <p v-if="hasValue(watch.text)" class="text-sm text-gray-400">
          {{ watch.text }}
        </p>

        <!-- Club reviews of this same watch: the physical viewing happened
             once, then was reviewed in each club — all showing the watch's
             one canonical score, so the sub-lines carry no score of their
             own. -->
        <ul
          v-if="watch.clubReviews.length > 0"
          class="mt-1 flex flex-col gap-1.5"
        >
          <li
            v-for="review in watch.clubReviews"
            :key="review.reviewId"
            class="flex flex-wrap items-center gap-2 text-sm text-gray-400"
          >
            <ContextChip :club-name="review.clubName" />
            <span>Reviewed {{ review.createdDate.slice(0, 10) }}</span>
            <router-link
              :to="{ name: 'Reviews', params: { clubSlug: review.clubSlug } }"
              class="text-xs text-highlight hover:underline"
            >
              View in {{ review.clubName }}
            </router-link>
          </li>
        </ul>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1">
        <span class="text-lg font-bold tabular-nums">
          {{ scoreDisplay
          }}<span v-if="isRated" class="text-xs text-gray-500">/10</span>
        </span>
        <div class="flex gap-1">
          <button
            class="text-gray-400 hover:text-white"
            aria-label="Edit log"
            @click="emit('edit')"
          >
            <mdicon name="pencil" :size="18" />
          </button>
          <!-- A watch with club reviews attached can't be deleted (it would
               orphan club history), so the affordance is hidden. -->
          <button
            v-if="watch.clubReviews.length === 0"
            class="text-gray-400 hover:text-white"
            aria-label="Delete log"
            @click="emit('delete')"
          >
            <mdicon name="delete-outline" :size="18" />
          </button>
        </div>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";

import ContextChip from "./ContextChip.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks";
import type { DiaryWatch } from "../../../../lib/types/me";

import { workTypeLogging } from "@/common/clubType";

const { watch } = defineProps<{ watch: DiaryWatch }>();

// "Rewatch" for movies, "Reread" for books — the repeat badge shows on book
// timelines too, so read the label off the registry instead of hard-coding it.
const repeatBadge = computed(
  () => workTypeLogging(watch.work.type).repeatBadge,
);

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "delete"): void;
}>();

const isRated = computed(() => isDefined(watch.score));
// score 0 is a real rating, so gate on isDefined (not truthiness); null → "–".
const scoreDisplay = computed(() =>
  isDefined(watch.score) ? watch.score : "–",
);

// Every timeline point needs a date; watches logged without a watched date
// fall back to the day they were logged (the same date the API sorts them by).
const displayDate = computed(
  () => watch.watchedDate ?? watch.createdDate.slice(0, 10),
);
</script>
