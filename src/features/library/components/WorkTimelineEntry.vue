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
          <ContextChip :context="entry.context" />
          <mdicon
            v-if="entry.rewatch"
            name="repeat"
            :size="16"
            class="shrink-0 text-gray-400"
            :title="repeatBadge"
            :aria-label="repeatBadge"
          />
        </div>
        <p v-if="hasValue(entry.text)" class="text-sm text-gray-400">
          {{ entry.text }}
        </p>
      </div>

      <div class="flex shrink-0 flex-col items-end gap-1">
        <span class="text-lg font-bold tabular-nums">
          {{ scoreDisplay
          }}<span v-if="isRated" class="text-xs text-gray-500">/10</span>
        </span>
        <div v-if="isSolo" class="flex gap-1">
          <button
            class="text-gray-400 hover:text-white"
            aria-label="Edit event"
            @click="emit('edit')"
          >
            <mdicon name="pencil" :size="18" />
          </button>
          <button
            class="text-gray-400 hover:text-white"
            aria-label="Delete event"
            @click="emit('delete')"
          >
            <mdicon name="delete-outline" :size="18" />
          </button>
        </div>
        <router-link
          v-else-if="isDefined(clubTarget)"
          :to="clubTarget"
          class="text-xs text-highlight hover:underline"
        >
          Edit in {{ clubName }}
        </router-link>
      </div>
    </div>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

import ContextChip from "./ContextChip.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks";
import type { DiaryEntry } from "../../../../lib/types/me";

import { workTypeLogging } from "@/common/clubType";

const { entry } = defineProps<{ entry: DiaryEntry }>();

// "Rewatch" for movies, "Reread" for books — the repeat badge shows on book
// timelines too, so read the label off the registry instead of hard-coding it.
const repeatBadge = computed(
  () => workTypeLogging(entry.work.type).repeatBadge,
);

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "delete"): void;
}>();

const isSolo = computed(() => entry.context.kind === "solo");
const isRated = computed(() => isDefined(entry.score));
// score 0 is a real rating, so gate on isDefined (not truthiness); null → "–".
const scoreDisplay = computed(() =>
  isDefined(entry.score) ? entry.score : "–",
);

// Every timeline point needs a date; events logged without a watched date fall
// back to the day they were logged (the same date the API sorts them by).
const displayDate = computed(
  () => entry.watchedDate ?? entry.createdDate.slice(0, 10),
);

// Club events are read-only here: deep-link to the club's Reviews page rather
// than editing the shared row inline.
const clubContext = computed(() =>
  entry.context.kind === "club" ? entry.context : undefined,
);
const clubName = computed(() => clubContext.value?.clubName ?? "");
const clubTarget = computed<RouteLocationRaw | undefined>(() => {
  const ctx = clubContext.value;
  return isDefined(ctx)
    ? { name: "Reviews", params: { clubSlug: ctx.clubSlug } }
    : undefined;
});
</script>
