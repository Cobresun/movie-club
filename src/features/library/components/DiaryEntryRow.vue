<template>
  <li class="flex gap-3 rounded-lg bg-lowBackground p-3">
    <img
      v-if="hasValue(entry.work.imageUrl)"
      v-lazy-load
      :src="entry.work.imageUrl"
      class="aspect-[2/3] w-12 shrink-0 rounded object-cover"
      alt=""
    />
    <div
      v-else
      class="flex aspect-[2/3] w-12 shrink-0 items-center justify-center rounded bg-slate-600"
    >
      <mdicon name="image-outline" :size="20" class="text-slate-400" />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <div class="flex items-center gap-2">
        <h3 class="truncate font-semibold">{{ entry.work.title }}</h3>
        <mdicon
          v-if="entry.rewatch"
          name="repeat"
          :size="16"
          class="shrink-0 text-gray-400"
          title="Rewatch"
          aria-label="Rewatch"
        />
        <mdicon
          v-if="hasText"
          name="pencil-outline"
          :size="16"
          class="shrink-0 text-gray-400"
          title="Has a written review"
          aria-label="Has a written review"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <ContextChip :context="entry.context" />
        <span v-if="hasValue(entry.watchedDate)" class="text-xs text-gray-500">
          {{ entry.watchedDate }}
        </span>
      </div>
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
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

import ContextChip from "./ContextChip.vue";
import { hasValue, isDefined } from "../../../../lib/checks/checks";
import type { DiaryEntry } from "../../../../lib/types/me";

const { entry } = defineProps<{ entry: DiaryEntry }>();

const emit = defineEmits<{
  (e: "edit"): void;
  (e: "delete"): void;
}>();

const isSolo = computed(() => entry.context.kind === "solo");
const hasText = computed(() => hasValue(entry.text));
const isRated = computed(() => isDefined(entry.score));
// score 0 is a real rating, so gate on isDefined (not truthiness); null → "–".
const scoreDisplay = computed(() =>
  isDefined(entry.score) ? entry.score : "–",
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
